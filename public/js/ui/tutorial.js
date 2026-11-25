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
      text: T(() => `${moveKeys()}로 걸어서 <em>아래쪽 문</em>으로 나가자 · 누군가 밖에서 부르고 있다`, '왼쪽 조이스틱으로 걸어서 <em>아래쪽 문</em>으로 나가자 · 누군가 밖에서 부르고 있다'),
      done: (w, t, c) => !c.inHouse() },
    { id: 'chief',
      text: T(() => `머리 위에 <em>「!」</em>가 뜬 촌장에게 다가가 <em>${keyName('KeyG')}</em>로 말을 걸자`, '머리 위에 <em>「!」</em>가 뜬 촌장에게 다가가 <em>「확인」</em> 버튼으로 말을 걸자'),
      done: (w, t, c) => { const s = c.save(); return !s.npcJourney || !!s.jAccept?.hunt || !!s.journey?.hunt; } },
    { id: 'attack',
      text: T(() => '사냥 전에 몸풀기: <em>좌클릭</em>으로 허수아비를 세 번 때리자 (마우스 쪽으로 휘두른다)', '사냥 전에 몸풀기: <em>오른쪽 조이스틱</em>을 밀어 허수아비를 세 번 때리자'),
      setup: (w, t) => {
        const at = w.openSpot(w.player.x, w.player.y), e = w.makeEnemy('dummy', at.x, at.y);
        e.home = { x: e.x, y: e.y }; e.tut = true; w.enemies.push(e);
        t.dummy = e; t.hp = e.hp; t.hits = 0;
      },
      done: (w, t) => { if (!t.dummy) return true; if (t.dummy.hp < t.hp) { t.hits++; t.hp = t.dummy.hp; } return t.hits >= 3; },
      count: (w, t) => `${Math.min(3, t.hits || 0)} / 3` },
    { id: 'weapon',
      text: T(() => '<em>우클릭</em>: 든 무기의 능력. 허수아비에게 한 번 써 보자 (각인이 없어도 쓸 수 있다)', '<em>「무기」</em> 버튼: 든 무기의 능력. 허수아비에게 한 번 써 보자'),
      done: (w) => w.player.skillCd > 0 || !!w.player.charging },
    { id: 'dash',
      text: T(() => `<em>${keyName('Space')}</em>: 구르기. 구르는 동안은 공격을 맞지 않는다 · 빨간 예고를 보면 구르자`, '<em>「대시」</em> 버튼: 구르기. 구르는 동안은 공격을 맞지 않는다 · 빨간 예고를 보면 구르자'),
      done: (w, t) => w.player.dashCharges < t.dash0 },
    { id: 'quest',
      text: T(() => `<em>${keyName('KeyJ')}</em>: 퀘스트 창. 지금 할 일과 「따라가기」(화살표)가 있다 · 열어 보자`, '<em>≡</em> 메뉴 → <em>퀘스트</em>: 지금 할 일과 「따라가기」(화살표)가 있다 · 열어 보자'),
      done: () => tutFlags.quest },
  ];
}

// 끝난 뒤 처음 한 번만: 그 조작을 처음 할 때가 된 순간 (when) 띠를 띄우고, 해 보면(done) 또는 시간이 지나면 닫는다
function tipsOf(touch) {
  const T = (pc, mobile) => () => (touch() ? mobile : pc());
  return [
    { id: 'skill', t: 30,
      when: (w, s) => w.b?.skills?.some(Boolean) && w.state === 'play',
      text: T(() => `새긴 각인의 스킬: <em>${['KeyQ', 'KeyE', 'KeyR', 'KeyF'].map(keyName).join(' · ')}</em> · 지금 <em>${keyName('KeyQ')}</em>를 눌러 써 보자`, '새긴 각인의 스킬: 오른쪽 아래 <em>1 · 2 · 3 · 4</em> 버튼 · 지금 <em>1</em>을 눌러 써 보자'),
      done: (w) => Object.keys(w.player.cdMax || {}).length > 0 },
    { id: 'potion', t: 7,
      when: (w) => w.state === 'play' && w.player.hp < w.d.maxHp * 0.4 && ['potion1', 'potion2', 'potion3'].some((id) => w.life?.bag?.[id] > 0),
      text: T(() => `체력이 낮다: <em>${keyName('KeyZ')}</em> 물약 · 물러나서 마시자 (마시는 동안은 굼뜨다)`, '체력이 낮다: <em>물약</em>을 마시자 · 물러나서 마시자 (마시는 동안은 굼뜨다)'),
      done: (w) => w.player.hp > w.d.maxHp * 0.7 },
    { id: 'points', t: 14,
      when: (w, s) => (s.points || 0) > 0 && w.state === 'play',
      text: T(() => `레벨이 올랐다: <em>${keyName('KeyC')}</em> 캐릭터 창에서 스탯 점수를 나누자`, '레벨이 올랐다: <em>캐릭터</em> 창에서 스탯 점수를 나누자'),
      done: (w, s) => !(s.points > 0) || tutFlags.panel },
    { id: 'map', t: 9,
      when: (w, s) => w.zone?.id === 'world' && !!s.journey?.hunt && w.state === 'play',
      text: T(() => `<em>${keyName('KeyM')}</em>: 섬 지도. 처음 가 보는 곳 · 열린 지역이 보인다`, '<em>≡</em> 메뉴 → <em>지도</em>: 처음 가 보는 곳 · 열린 지역이 보인다'),
      done: () => false },
    { id: 'hurt', t: 7,
      when: (w) => w.state === 'play' && w.player.hp < w.d.maxHp * 0.85 && !w.practice,
      text: T(() => `맞았다! 왼쪽 위 빨간 막대가 체력 · 빨간 예고 원이 보이면 <em>${keyName('Space')}</em>로 굴러 피하자`, '맞았다! 왼쪽 위 빨간 막대가 체력 · 빨간 예고 원이 보이면 <em>「대시」</em>로 굴러 피하자'),
      done: () => false },
    { id: 'pickup', t: 7,
      when: (w) => w.state === 'play' && (w.drops || []).some((d) => Math.hypot(d.x - w.player.x, d.y - w.player.y) < 140),
      text: T(() => '떨어진 것은 <em>가까이 걸어가면</em> 저절로 줍는다 · 반짝이는 것이 잔향(몬스터 부산물)', '떨어진 것은 <em>가까이 걸어가면</em> 저절로 줍는다 · 반짝이는 것이 잔향(몬스터 부산물)'),
      done: () => false },
    { id: 'echo', t: 10,
      when: (w, s) => w.state === 'play' && Object.values(s.echoes || {}).some((n) => n > 0),
      text: T(() => '첫 <em>잔향</em>을 얻었다! 잔향을 모아 마을 <em>공명 제단</em>에서 각인을 새긴다 · 각인 = 스킬', '첫 <em>잔향</em>을 얻었다! 잔향을 모아 마을 <em>공명 제단</em>에서 각인을 새긴다 · 각인 = 스킬'),
      done: () => false },
    { id: 'talk', t: 9,
      when: (w) => w.state === 'play' && !!w.near,
      text: T(() => `<em>${keyName('KeyG')}</em>: 말 걸기 · 줍기 · 열기 · 머리 위 <em>!</em>는 맡길 일이 있다는 뜻 · <em>?</em>는 알리러 갈 차례`, '<em>「확인」</em> 버튼: 말 걸기 · 머리 위 <em>!</em>는 맡길 일이 있다는 뜻 · <em>?</em>는 알리러 갈 차례'),
      done: () => tutFlags.interact },
    { id: 'eat', t: 9,
      when: (w) => w.state === 'play' && w.player.hp < w.d.maxHp * 0.6 && !!hasFood(),
      text: T(() => `<em>${keyName('KeyH')}</em>: 음식 먹기 (1.6초 · 그동안 느리고 맞으면 끊긴다) · 탑 안에서는 요리가 유일한 회복`, '<em>「음식」</em> 버튼: 먹기 (1.6초 · 그동안 느리고 맞으면 끊긴다) · 탑 안에서는 요리가 유일한 회복'),
      done: (w) => w.player.hp > w.d.maxHp * 0.8 },
    { id: 'level', t: 9,
      when: (w, s) => w.state === 'play' && (s.level || 1) >= 2,
      text: T(() => '레벨 업! 레벨은 <em>도감 점수</em>(처음 잡은 몬스터 · 가 본 곳 · 만난 사람)로 오른다 · 새로운 것을 찾아다니자', '레벨 업! 레벨은 <em>도감 점수</em>(처음 잡은 몬스터 · 가 본 곳 · 만난 사람)로 오른다'),
      done: () => false },
    { id: 'tower', t: 10,
      when: (w) => w.state === 'play' && !!w.climb,
      text: T(() => '탑 안: 층마다 몬스터를 모두 쓰러뜨리면 문이 열린다 · 회복은 요리뿐 · 저장은 10층마다', '탑 안: 층마다 몬스터를 모두 쓰러뜨리면 문이 열린다 · 회복은 요리뿐 · 저장은 10층마다'),
      done: () => false },
    { id: 'boss', t: 9,
      when: (w) => w.state === 'play' && (w.enemies || []).some((e) => e.boss && !e.dead),
      text: T(() => `보스! 빨간 예고를 잘 보고 <em>${keyName('Space')}</em>로 피한 뒤 빈틈에 치자 · 쓰러뜨리면 체력 40% 회복`, '보스! 빨간 예고를 잘 보고 <em>「대시」</em>로 피한 뒤 빈틈에 치자 · 쓰러뜨리면 체력 40% 회복'),
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
    if (done) ctx.banner({ text: '준비 끝!', sub: ctx.touch() ? '노란 화살표를 따라가자 · 왼쪽 위의 여정 칸이 지금 할 일' : '노란 화살표를 따라가자 · 오른쪽 위의 여정 칸이 지금 할 일', t: 5, color: '#f6dfae' });
    ctx.writeSave();
  }

  function show(html, skip = true) {
    if (!el) {
      el = document.createElement('div'); el.id = 'tut'; document.body.appendChild(el);
      el.addEventListener('click', (e) => { if (e.target.dataset.tutskip != null) finish(false); if (e.target.dataset.tipclose != null && tip) { (ctx.save().tips ||= {})[tip.def.id] = 1; tip = null; el.hidden = true; } });
    }
    el.hidden = false;
    html = skip ? `${html}<button data-tutskip>건너뛰기</button>` : `${html}<button data-tipclose aria-label="닫기">✕</button>`;
    if (html !== shown) { el.innerHTML = html; shown = html; } // 글이 바뀔 때만 다시 그린다 (매 프레임 다시 만들면 「건너뛰기」 누르기가 씹힌다)
  }
  const hide = () => { if (el) el.hidden = true; };

  // 튜토리얼이 끝난 뒤: 처음 해 보는 조작 알림 (한 번에 하나 · 정해진 시간만)
  function tickTips(dt, w, s) {
    if (tip) {
      tip.t -= dt;
      if (tip.def.done(w, s) || tip.t <= 0) { (s.tips ||= {})[tip.def.id] = 1; tip = null; hide(); ctx.writeSave(); return; }
      show(`<small>처음 해 보기</small><b>${tip.def.text()}</b>`, false);
      return;
    }
    hide();
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
    show(`<small>처음 하기 ${T.step + 1} / ${STEPS.length}</small><b>${step.text()}${cnt ? ` <i>${cnt}</i>` : ''}</b>`);
    if (step.done(w, rt, c)) { T.step++; ctx.sfx('open', { vol: 0.5, rate: 1.4 }); ctx.writeSave(); }
  }

  return { tick, finish };
}

// ───── 창을 처음 열 때의 안내 (그 창에서 할 일을 1~3단계로) ─────
// 창 안 구조는 건드리지 않고 위에 덮는다. g: data-guide 이름(있으면 우선) · sel: 없으면 찾을 선택자 — 둘 다 없으면 그 단계는 조용히 건너뛴다
const GUIDES = {
  'tab:altar': [
    { g: 'altar-list', sel: '#engList', text: '각인 목록. 이름을 누르면 오른쪽에 필요한 <em>잔향(재료)</em>과 내가 가진 수가 보인다 · <em>새길 수 있음</em>이 붙은 것부터 보자' },
    { g: 'altar-detail', sel: '.eng-detail', text: '재료가 다 있으면 <em>새기기</em>. 새긴 각인은 스킬 칸에 끼워야 쓸 수 있다' },
    { g: 'altar-slots', sel: '.slots', text: '위쪽 칸이 지금 끼운 각인. Q · E · R · F 칸에 끼우면 그 키로 스킬이 나간다 · 마지막 칸은 패시브만' },
  ],
  'tab:skills': [
    { g: 'skill-slots', sel: '.slots, .skill-row', text: '스킬 칸. 새긴 각인을 골라 Q · E · R · F에 끼운다 · 비어 있으면 그 키는 아무것도 안 한다' },
    { text: '각인마다 <em>부하</em>가 있다. 끼운 부하의 합이 한도를 넘을 수 없다 (레벨이 오르면 한도가 는다)' },
  ],
  'tab:gear': [
    { g: 'gear-slots', sel: '.slots', text: '장비 칸: 무기 · 왼손 · 몸. 아래 목록에서 눌러 바로 바꿔 낀다' },
    { text: '무기마다 평타 동작과 <em>우클릭</em> 능력이 다르다 · 맨손(주먹)은 언제나 쓸 수 있다' },
  ],
  'tab:bag': [ { text: '가방: 주운 재료 · 음식 · 물약. 음식은 <em>H</em>, 물약은 <em>Z</em>로 바로 먹는다 · 탑 안 회복은 요리뿐' } ],
  'tab:char': [
    { g: 'stats', sel: '[data-act="alloc"]', text: '레벨이 오르면 받는 스탯 점수를 <em>+</em>로 나눈다. 한 점이 크다 (공격 · 민첩 · 체력 · 정신 …)' },
    { text: '잘못 나눴으면 아래에서 되돌릴 수 있다' },
  ],
  'tab:codex': [ { text: '도감: 처음 잡은 몬스터 · 처음 가 본 곳 · 만난 사람이 점수가 되어 <em>레벨</em>이 오른다. ???는 아직 못 본 것' } ],
  'tab:shop': [ { text: '대장간: 골드로 장비를 사고, 가진 장비를 <em>강화</em>한다 · 옆 탭에서 제작도 할 수 있다' } ],
  'tab:forge': [ { text: '제작 · 강화: 재료와 골드로 장비를 더 세게 만든다. 모자란 재료는 빨갛게 보인다' } ],
  'tab:craft': [ { text: '무기 만들기: 재료를 모아 새 무기를 만든다. 무기는 누구나 든다' } ],
  'tab:trade': [ { text: '잡화점: 낚싯대 · 미끼 · 씨앗 · 물약을 산다. 남는 재료는 여기서 판다' } ],
  'tab:cook': [ { text: '부엌: 재료를 골라 <em>요리</em>한다. 요리는 탑 안에서 유일하게 체력을 채우는 음식 · 처음 만든 요리는 이름이 붙는다' } ],
  'tab:storage': [ { text: '보관함: 가방에서 넘치는 것을 맡긴다' } ],
  'tab:quest': [ { text: '의뢰 게시판: 하나 받아 해내고, 여기로 돌아와 <em>보상 받기</em>' } ],
  'tab:where': [ { text: '어디서 얻나: 잔향 · 재료가 어느 몬스터 · 어느 지역에서 나오는지 찾아본다' } ],
  quest: [
    { g: 'journey', sel: '.jlist', text: '여정: 맨 위가 <em>지금 할 일</em>. 「따라가기」를 누르면 노란 화살표가 길을 알려 준다' },
    { text: '의뢰 게시판 · 성지 의뢰도 여기서 함께 본다 · 다 하면 맡긴 곳에 알리러 가자' },
  ],
  settings: [ { g: 'keys', sel: '.keys-set', text: '「키 바꾸기」에서 조작 키를 바꿀 수 있다 · 안내 글도 바꾼 키로 보인다 · 맨 아래에서 처음 안내를 끄거나 다시 볼 수 있다' } ],
  merchant: [ { text: '떠돌이 상인: 때마다 파는 것이 바뀐다 · 쓸 만한 것이 보이면 그때 사 두자' } ],
  map: [ { text: '섬 지도: 처음 가 보는 곳은 어둡다 · 탑을 오르면 새 지역이 열린다 · 다시 누르면 닫힌다' } ],
  fishing: [ { text: '낚시: 찌가 흔들리며 <em>!</em>가 뜨면 바로 당긴다 (좌클릭) · 줄이 팽팽하면 잠깐 늦추자' } ],
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
  const keyText = (t) => (ctx.touch() ? t.replace(/<em>H<\/em>/g, '<em>「음식」</em>').replace(/<em>Z<\/em>/g, '<em>「물약」</em>').replace(/\(좌클릭\)/g, '(오른쪽 조이스틱)').replace(/<em>우클릭<\/em>/g, '<em>「무기」</em> 버튼')
    : t.replace(/<em>H<\/em>/g, `<em>${keyName('KeyH')}</em>`).replace(/<em>Z<\/em>/g, `<em>${keyName('KeyZ')}</em>`));
  function close(done) {
    if (cur && done) { const s = ctx.save(); (s.guides ||= {})[cur.key] = 1; ctx.writeSave(); }
    cur = null; if (box) box.hidden = true; if (card) card.hidden = true;
  }
  function ensure() {
    if (card) return;
    box = document.createElement('div'); box.id = 'guideHi'; box.hidden = true;
    card = document.createElement('div'); card.id = 'guide'; card.hidden = true;
    document.body.append(box, card);
    card.addEventListener('click', (e) => {
      e.stopPropagation();
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
    card.innerHTML = `<small>처음 보는 창${cur.steps.length > 1 ? ` · ${cur.i + 1} / ${cur.steps.length}` : ''}</small><b>${keyText(st.text)}</b><span class="g-act">${last ? '' : '<button class="ghost sm" data-gskip>그만 보기</button>'}<button class="sm" data-gnext>${last ? '알겠어요' : '다음'}</button></span>`;
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
    if (phase === 'done') { s.firstEngTut = { ...(s.firstEngTut || {}), used: 1, done: 1 }; (s.guides ||= {})['tab:altar'] = 1; ctx.writeSave(); ctx.banner?.({ text: '첫 각인을 새겼다!', sub: '잔향을 모아 공명 제단에서 각인을 더 새기자 · 노란 화살표가 다음 할 일', t: 5, color: '#f6dfae' }); phase = null; }
    if (phase && !(w && (w.state === 'play' || key))) phase = null; // 싸움 밖 화면(죽음 등)에선 잠깐 숨긴다
    firstEngState.phase = phase;
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
    const html = `<small>첫 각인 · 하나씩 따라 하기</small><b>${nudge ? '<span class="g-nudge">여기를 누르자 → </span>' : ''}${sp.text}</b>${sp.btn ? `<span class="g-act"><button class="sm" data-gforce="${sp.act}">${sp.btn}</button></span>` : ''}`;
    if (html !== fe.html) { card.innerHTML = html; fe.html = html; }
    card.hidden = false; card.classList.add('forced'); card.classList.toggle('raise', !ALTAR_PHASES.has(phase)); card.classList.toggle('nudge', nudge);
    cur = null;
    const el = fe.el;
    if (el && el.isConnected && el.getBoundingClientRect().width) { const r = el.getBoundingClientRect(); Object.assign(box.style, { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${Math.min(r.height, innerHeight - r.top) + 8}px` }); box.hidden = false; }
    else box.hidden = true;
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
    if (cur && cur.key !== key) close(false); // 창을 닫거나 다른 탭으로: 다음에 다시 열면 또 보인다
    if (cur) { if (!cur.el?.isConnected && cur.el) cur.el = find(cur.steps[cur.i]); place(); return; }
    if (!key || s.guideOff || s.guides?.[key] || !GUIDES[key]) { if (!cur) { card.hidden = true; box.hidden = true; } return; }
    if (s.tutorial && !s.tutorial.done && key !== 'quest') return; // 몸풀기 중에는 퀘스트 창만
    ensure(); cur = { key, steps: GUIDES[key], i: 0 }; draw();
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
  const key = touch ? `${Math.max(0, slot) + 1}번 버튼` : keyName(['KeyQ', 'KeyE', 'KeyR', 'KeyF'][Math.max(0, slot)]);
  const G = touch ? '「확인」 버튼' : keyName('KeyG');
  switch (phase) {
    case 'report': return { text: `사냥을 마쳤다! 머리 위 <em>「?」</em>가 뜬 <em>촌장</em>에게 돌아가 <em>${G}</em>로 알리자 · 노란 화살표를 따라가자` };
    case 'mats': return { text: `${nm} 각인의 <em>재료</em>를 받았다. 종족의 첫 각인이다 · 공명 제단에서 이 재료로 새긴다`, btn: '알겠어요', act: 'ack' };
    case 'rune': return { text: `각인사 <em>루네</em>에게 가자 · 공명 제단 건물 안 (노란 화살표) · 머리 위 <em>「!」</em>에서 <em>${G}</em>로 말 걸기` };
    case 'open': return { text: `<em>공명 제단</em>으로 가서 루네 앞에서 <em>${G}</em> · 제단 창을 열자 (노란 화살표)` };
    case 'select': return { sel: `[data-act="aselect"][data-id="${eid}"]`, text: `각인 목록에서 ${nm}을 누르자 · 오른쪽에 필요한 재료가 보인다` };
    case 'full': return { sel: '[data-guide="altar-recipe"]', text: '재료 <em>◆</em>가 모두 찼다 (가진 수 / 필요한 수) · 이제 새길 수 있다', btn: '다음', act: 'seenMats' };
    case 'engrave': return { sel: '[data-guide="altar-engrave"]', text: `<em>「새기기」</em>를 눌러 ${nm}을 몸에 새기자` };
    case 'equip': return { sel: '[data-guide="altar-equip"]', text: '새긴 각인은 스킬 칸에 끼워야 쓴다 · <em>「장착」</em>을 누르자' };
    case 'close': return { sel: '[data-guide="hub-close"]', text: `창을 닫자 (<em>${touch ? '✕' : 'Esc'}</em>) · 이제 스킬을 써 볼 차례` };
    case 'use': return { text: `<em>${key}</em>를 눌러 ${sk ? `「${sk.name}」` : '새 스킬'}을 써 보자 · 자원이 모자라면 평타로 모은다` };
  }
  return { text: '' };
}

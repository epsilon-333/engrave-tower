// 튜토리얼: 꿈에서 깨어 내 집 → 문 밖의 촌장 → 허수아비로 몸풀기 → 퀘스트 창(따라가기)까지, 조작을 하나씩 따라 한다 (건너뛸 수 있다).
// 끝난 뒤에도 처음 해 보는 조작(새긴 스킬 · 물약 · 스탯 점수 · 지도)은 그때 한 번씩 짧게 알려 준다 (save.tips).
// 세계(World)와 저장만 보고 판단하고, 화면에는 띠 하나(#tut)만 그린다. 키 이름은 키 바꾸기(settings.js)를 따른다.
import { keyFor, keyLabel } from '../settings.js';

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
  ];
}

// ctx: { save(), world(), paused(), touch(), inHouse(), sfx(name, opt), writeSave(), banner(b), follow() }
export function createTutorial(ctx) {
  const STEPS = steps(ctx.touch), TIPS = tipsOf(ctx.touch);
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
    if (!T || T.done) { if (T?.done && !w.pvp && !w.practice) tickTips(dt, w, s); else hide(); return; }
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

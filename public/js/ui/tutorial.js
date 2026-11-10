// 튜토리얼: 마을 광장에서 조작을 하나씩 따라 한다 (건너뛸 수 있다).
// 세계(World)와 저장만 보고 판단하고, 화면에는 띠 하나(#tut)만 그린다.

// 창 열기 · 상호작용은 세계 밖(main.js)에서 일어나므로 여기에 표시해 둔다
export const tutFlags = { interact: false, panel: false };

// 단계마다: 안내 글(휴대폰이면 터치 조작으로) · 준비(setup) · 끝났나(done)
function steps(touch) {
  const T = (pc, mobile) => () => (touch() ? mobile : pc);
  return [
    { text: T('WASD로 걸어 보자', '왼쪽 조이스틱으로 걸어 보자'),
      done: (w, t) => Math.hypot(w.player.x - t.x0, w.player.y - t.y0) > 70 },
    { text: T('Space로 굴러 보자. 구르는 동안은 공격을 피한다', '「대시」 버튼으로 굴러 보자. 구르는 동안은 공격을 피한다'),
      done: (w, t) => w.player.dashCharges < t.dash0 },
    { text: T('좌클릭으로 허수아비를 세 번 때려 보자 (마우스 쪽으로 휘두른다)', '오른쪽 조이스틱을 눌러 허수아비를 세 번 때려 보자'),
      setup: (w, t) => {
        const at = w.openSpot(w.player.x, w.player.y), e = w.makeEnemy('dummy', at.x, at.y);
        e.home = { x: e.x, y: e.y }; e.tut = true; w.enemies.push(e);
        t.dummy = e; t.hp = e.hp; t.hits = 0;
      },
      done: (w, t) => { if (!t.dummy) return true; if (t.dummy.hp < t.hp) { t.hits++; t.hp = t.dummy.hp; } return t.hits >= 3; } },
    { text: T('Q · E 스킬로 허수아비를 맞혀 보자. [차지]라고 적힌 스킬은 길게 눌렀다 놓으면 세진다', '스킬 버튼으로 허수아비를 맞혀 보자. [차지]라고 적힌 스킬은 길게 눌렀다 놓으면 세진다'),
      setup: (w, t) => { if (t.dummy && !t.dummy.dead) t.dummy.hp = t.dummy.maxHp; t.hp0 = t.dummy?.hp ?? 0; },
      done: (w, t) => Object.values(w.player.cds || {}).some((v) => v > 0.45) && (!t.dummy || t.dummy.dead || t.dummy.hp < t.hp0) },
    { text: T('우클릭으로 무기 기술을 써 보자', '「무기」 버튼으로 무기 기술을 써 보자'),
      done: (w) => w.player.skillCd > 0 || !!w.player.charging },
    { text: T('무언가 앞에서 G: 표지판을 읽고, 사람에게 말을 걸고, 모닥불에서 쉰다', '무언가 앞에서 나타나는 버튼: 표지판을 읽고, 사람에게 말을 걸고, 모닥불에서 쉰다'),
      done: () => tutFlags.interact },
    { text: T('I 장비 · B 가방 · J 퀘스트 · C 캐릭터: 하나를 열어 보자', '「≡」 메뉴에서 캐릭터 · 장비 · 가방 창을 열어 보자'),
      done: () => tutFlags.panel },
  ];
}

// ctx: { save(), world(), paused(), touch(), sfx(name, opt), writeSave(), banner(b) }
export function createTutorial(ctx) {
  const STEPS = steps(ctx.touch);
  let el = null, rt = null, shown = '';

  function finish(done) {
    const s = ctx.save(), w = ctx.world();
    s.tutorial = { done: true };
    if (rt?.dummy && w) { rt.dummy.dead = true; w.enemies = w.enemies.filter((e) => e !== rt.dummy); }
    rt = null;
    if (el) el.hidden = true;
    if (done) ctx.banner({ text: '튜토리얼 끝!', sub: '오른쪽 위의 여정을 따라가자 · 먼저 사냥부터', t: 4.5, color: '#f6dfae' });
    ctx.writeSave();
  }

  function show(html) {
    if (!el) {
      el = document.createElement('div'); el.id = 'tut'; document.body.appendChild(el);
      el.addEventListener('click', (e) => { if (e.target.dataset.tutskip != null) finish(false); });
    }
    el.hidden = false;
    if (html !== shown) { el.innerHTML = html; shown = html; } // 글이 바뀔 때만 다시 그린다 (매 프레임 다시 만들면 「건너뛰기」 누르기가 씹힌다)
  }

  function tick() {
    const T = ctx.save()?.tutorial, w = ctx.world();
    if (!T || T.done || !w || w.zone?.id !== 'world' || w.state !== 'play' || ctx.paused()) { if (el) el.hidden = true; return; }
    const step = STEPS[T.step];
    if (!step) { finish(true); return; }
    if (!rt || rt.step !== T.step || rt.world !== w) { // 새 단계 · 새 세계: 처음 자리를 기억하고 준비한다
      rt = { ...(rt?.world === w ? rt : {}), step: T.step, world: w, x0: w.player.x, y0: w.player.y, dash0: w.player.dashCharges };
      tutFlags.interact = false; tutFlags.panel = false;
      step.setup?.(w, rt);
    }
    show(`<small>튜토리얼 ${T.step + 1} / ${STEPS.length}</small><b>${step.text()}</b><button data-tutskip>건너뛰기</button>`);
    if (step.done(w, rt)) { T.step++; ctx.sfx('open', { vol: 0.5, rate: 1.4 }); ctx.writeSave(); }
  }

  return { tick, finish };
}

import { SKILLS } from './data/skills.js';
// 모바일 터치 조작: 왼쪽 조이스틱 이동, 오른쪽 조이스틱 조준+공격, 버튼(스킬·대시·상호작용·오러·메뉴)
// 오른쪽 조이스틱을 쓰지 않을 때는 가까운 적을 자동으로 조준한다.
export const isTouch = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export function setupTouch({ input, getWorld, onMenu, onBag, onInteract }) {
  const root = document.createElement('div');
  root.id = 'touch';
  root.innerHTML = `
    <div class="stick left" data-stick="move"><div class="knob"></div></div>
    <div class="stick right" data-stick="aim"><div class="knob"></div><span>공격</span></div>
    <button class="tb s1" data-btn="s1">1</button>
    <button class="tb s2" data-btn="s2">2</button>
    <button class="tb s3" data-btn="s3">3</button>
    <button class="tb s4" data-btn="s4">4</button>
    <button class="tb wsk" data-btn="wskill">무기</button>
    <button class="tb dash" data-btn="dash">대시</button>
    <button class="tb act" data-btn="interact" hidden>G</button>
    <button class="tb menu" data-btn="menu" aria-label="메뉴">≡</button>
    <button class="tb bag" data-btn="bag" hidden>캐릭터</button>`;
  document.getElementById('game').appendChild(root);

  const sticks = {};
  for (const el of root.querySelectorAll('.stick')) {
    const kind = el.dataset.stick, knob = el.querySelector('.knob');
    const st = sticks[kind] = { el, knob, id: null, x: 0, y: 0, active: false };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      st.id = e.pointerId; st.active = true; try { el.setPointerCapture(e.pointerId); } catch { /* 합성 이벤트 */ }
      move(st, e);
    });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === st.id) move(st, e); });
    const end = (e) => {
      if (e.pointerId !== st.id) return;
      st.id = null; st.active = false; st.x = st.y = 0;
      knob.style.transform = 'translate(-50%, -50%)';
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  function move(st, e) {
    const r = st.el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
    let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    st.x = dx; st.y = dy;
    st.knob.style.transform = `translate(calc(-50% + ${dx * R * 0.6}px), calc(-50% + ${dy * R * 0.6}px))`;
  }

  for (const b of root.querySelectorAll('[data-btn]')) {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const k = b.dataset.btn;
      b.classList.add('down');
      if (k === 'menu') return onMenu();
      if (k === 'bag') return onBag();
      if (k === 'interact') { input.gHeld = true; if (onInteract?.() === false) return; }
      input[k] = true;
      if (/^s\d$/.test(k)) input['h' + k[1]] = true;
    });
    const up = () => { b.classList.remove('down'); const k = b.dataset.btn; if (/^s\d$/.test(k)) input['h' + k[1]] = false; if (k === 'interact') input.gHeld = false; };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
  }

  let lastDir = { x: 1, y: 0 };
  return {
    root,
    // 매 프레임 호출: 조이스틱 → 입력
    apply() {
      const w = getWorld();
      if (!w) return;
      const p = w.player, mv = sticks.move, aim = sticks.aim;
      const dead = 0.18;
      const ml = Math.hypot(mv.x, mv.y);
      input.moveX = ml > dead ? mv.x : 0;
      input.moveY = ml > dead ? mv.y : 0;
      if (ml > dead) lastDir = { x: mv.x / ml, y: mv.y / ml };
      const al = Math.hypot(aim.x, aim.y);
      if (aim.active && al > 0.25) {
        input.aimX = p.x + (aim.x / al) * 120; input.aimY = p.y + (aim.y / al) * 120;
        input.attack = true;
      } else {
        // 자동 조준: 가까운 적 → 없으면 이동 방향
        let best = null, bd = 220;
        for (const e of w.enemies) {
          if (e.dead || e.hidden || e.def.ai === 'dummy') continue;
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) { input.aimX = best.x; input.aimY = best.y; }
        else { input.aimX = p.x + lastDir.x * 120; input.aimY = p.y + lastDir.y * 120; }
        input.attack = aim.active;
      }
      // 상황에 따라 보이는 버튼
      // 상호작용 대상: 물건(near) · 나무·밭·물가(act) · 다른 사람(nearRemote — 결투·친구)
      const ib = root.querySelector('[data-btn=interact]');
      ib.hidden = !(w.near || w.act || w.nearRemote);
      const it = w.near ? (w.near.kind === 'chest' ? '열기' : w.near.kind === 'gate' ? '입장' : '확인') : w.nearRemote ? '만나기' : 'G';
      if (ib.textContent !== it) ib.textContent = it;
      const sks = w.b.skills || [];
      for (let i = 0; i < 4; i++) {
        const el = root.querySelector(`[data-btn=s${i + 1}]`), id = sks[i];
        el.hidden = !id;
        if (!id) continue;
        const sk = SKILLS[id];
        const nm = id === 'weapon' ? '무기' : sk.name.slice(0, 4);
        if (el.textContent !== nm) el.textContent = nm;
        const cd = id === 'weapon' ? p.skillCd : p.cds[id] || 0;
        const need = sk ? (sk.costAll ? sk.costAll.min : sk.cost || 0) : 0;
        el.classList.toggle('cool', cd > 0 || need > p.res);
      }
      root.querySelector('[data-btn=bag]').hidden = w.mode !== 'plaza';
    },
    reset() { for (const st of Object.values(sticks)) { st.active = false; st.x = st.y = 0; st.knob.style.transform = 'translate(-50%, -50%)'; } input.attack = false; },
  };
}

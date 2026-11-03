// 게임패드 (Xbox · PlayStation 배치, 표준 매핑)
// 왼쪽 스틱 이동 · 오른쪽 스틱 조준 (놓으면 가까운 적 자동 조준) · RT 평타 · LT 무기 기술
// LB Q · RB E · Y R · B F · A 구르기 · X 상호작용(G) · Start 일시정지 · Back 캐릭터 · 십자키 위/아래 창 안에서 고르기
const DEAD = 0.22;
let prev = [], lastUse = 0;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

export function padState() {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const gp = pads[0];
  if (!gp) return null;
  const b = gp.buttons.map((x) => x.pressed || x.value > 0.5), ax = gp.axes.map(dz);
  const was = prev, pressed = (i) => b[i] && !was[i]; // 이번에 막 눌렸나 (지난번 상태와 견준다)
  if (b.some(Boolean) || ax.some((v) => v)) lastUse = performance.now();
  const st = { b, ax, pressed, active: performance.now() - lastUse < 4000 };
  prev = b;
  return st;
}

// 싸울 때: input 을 채운다
export function applyPad(st, input, player) {
  const [lx, ly, rx, ry] = st.ax;
  input.moveX = lx; input.moveY = ly;
  const ra = Math.hypot(rx, ry);
  if (ra > 0.3 && player) { input.aimX = player.x + (rx / ra) * 80; input.aimY = player.y + (ry / ra) * 80; input.autoAim = false; }
  else if (player) { input.autoAim = true; if (lx || ly) { input.aimX = player.x + lx * 80; input.aimY = player.y + ly * 80; } }
  input.attack = st.b[7];
  if (st.pressed(6)) input.wskill = true;
  if (st.pressed(0)) input.dash = true;
  if (st.pressed(2)) input.interact = true;
  if (st.pressed(4)) input.s1 = true;
  if (st.pressed(5)) input.s2 = true;
  if (st.pressed(3)) input.s3 = true;
  if (st.pressed(1)) input.s4 = true;
  input.h1 = st.b[4]; input.h2 = st.b[5]; input.h3 = st.b[3]; input.h4 = st.b[1];
  input.gHeld = st.b[2];
}

// 창이 떠 있을 때: 십자키로 버튼을 고르고 A로 누른다 · B는 닫기(Esc)
export function padMenu(st, root, onBack) {
  if (!root) return;
  const list = [...root.querySelectorAll('button:not([disabled]), input, select, summary')].filter((el) => el.offsetParent !== null);
  if (!list.length) return;
  let i = list.indexOf(document.activeElement);
  const move = (d) => { i = i < 0 ? 0 : (i + d + list.length) % list.length; list[i].focus(); list[i].scrollIntoView?.({ block: 'nearest' }); };
  if (st.pressed(13) || st.pressed(15)) move(1);
  if (st.pressed(12) || st.pressed(14)) move(-1);
  if (st.pressed(0)) { if (i < 0) move(0); else list[i].click(); }
  if (st.pressed(1)) onBack?.();
}

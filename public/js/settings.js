// 기기별 설정 (브라우저에만 저장)
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
let autoAim = TOUCH; // 자동 조준: 휴대폰은 켜고, 마우스로 하는 PC는 끈다 (조준도 실력)
try { const v = localStorage.getItem('et-autoaim'); if (v != null) autoAim = v === '1'; } catch { /* 무시 */ }
export const getAutoAim = () => autoAim;
export function setAutoAim(v) {
  autoAim = !!v;
  try { localStorage.setItem('et-autoaim', autoAim ? '1' : '0'); } catch { /* 무시 */ }
}

// NPC 공격: 켜 두면 누구든 때릴 수 있다 (맞은 사람은 화가 나 싸운다) · 기본은 꺼짐 (마을에서 실수로 사람을 때리지 않게)
let npcAttack = false;
try { npcAttack = localStorage.getItem('et-npcattack') === '1'; } catch { /* 무시 */ }
export const getNpcAttack = () => npcAttack;
export function setNpcAttack(v) {
  npcAttack = !!v;
  try { localStorage.setItem('et-npcattack', npcAttack ? '1' : '0'); } catch { /* 무시 */ }
}

// 화면 설정: 화면 흔들림 세기(0 · 0.5 · 1) · 피해 숫자(all 모두 · crit 치명타만 · off 끔) · 글자 크기(1 · 1.25 · 1.5)
const OPT_KEY = 'et-opts';
export const opts = { shake: 1, dmgNum: 'all', textScale: 1 };
try { Object.assign(opts, JSON.parse(localStorage.getItem(OPT_KEY) || '{}')); } catch { /* 무시 */ }
export function setOpt(k, v) { opts[k] = v; try { localStorage.setItem(OPT_KEY, JSON.stringify(opts)); } catch { /* 무시 */ } }

// ───── 키 바꾸기 ─────
// 행동마다 기본 키(KeyboardEvent.code). 바꾼 것만 저장한다. 게임은 눌린 키를 「기본 키」로 바꿔 읽는다 (logicalKey)
export const KEY_ACTIONS = [
  ['KeyW', '위로 이동'], ['KeyA', '왼쪽으로 이동'], ['KeyS', '아래로 이동'], ['KeyD', '오른쪽으로 이동'],
  ['Space', '구르기'], ['KeyG', '상호작용'],
  ['KeyQ', '스킬 1'], ['KeyE', '스킬 2'], ['KeyR', '스킬 3'], ['KeyF', '스킬 4'],
  ['KeyH', '음식'], ['KeyZ', '물약'], ['KeyV', '탈것'],
  ['KeyC', '캐릭터'], ['KeyI', '장비'], ['KeyB', '가방'], ['KeyJ', '퀘스트'], ['KeyM', '지도'],
];
const KEYS_KEY = 'et-keys';
let binds = {}; // 기본 키 → 내가 고른 키
try { binds = JSON.parse(localStorage.getItem(KEYS_KEY) || '{}') || {}; } catch { /* 무시 */ }
const saveBinds = () => { try { localStorage.setItem(KEYS_KEY, JSON.stringify(binds)); } catch { /* 무시 */ } };

export const keyFor = (def) => binds[def] || def;
// 눌린 키 → 그 키가 맡은 행동의 기본 키. 다른 키로 옮겨 간 행동의 원래 키는 null (아무것도 안 한다)
export function logicalKey(code) {
  for (const [def, k] of Object.entries(binds)) if (k === code) return def;
  if (binds[code] && binds[code] !== code) return null;
  return code;
}
// 행동 하나에 새 키: 다른 행동이 쓰던 키면 서로 바꾼다
export function bindKey(def, code) {
  const old = keyFor(def);
  for (const [d] of KEY_ACTIONS) if (d !== def && keyFor(d) === code) binds[d] = old;
  binds[def] = code;
  for (const [d, k] of Object.entries(binds)) if (d === k) delete binds[d];
  saveBinds();
}
export function resetKeys() { binds = {}; saveBinds(); }
export const keyLabel = (code) => code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '방향키 ').replace('Space', 'Space');

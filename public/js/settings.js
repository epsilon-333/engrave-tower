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
